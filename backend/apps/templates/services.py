from django.db import transaction
from rest_framework.exceptions import ValidationError
from apps.projects.models import Project
from apps.tasks.models import Task, SubTask
from apps.clients.models import Client
from apps.accounts.tenant_context import get_active_organization


class TemplateProjectService:
    @staticmethod
    def create_project_from_template(template, payload, user, organization=None):
        if not organization:
            organization = get_active_organization(user)

        project_name = payload.get('name') or (template.name if template else None)
        if not project_name or not str(project_name).strip():
            raise ValidationError({'name': ['Project name is required.']})

        description = payload.get('description', '')
        project_date = payload.get('project_date')
        client_id = payload.get('client')

        client_obj = None
        if client_id:
            try:
                client_obj = Client.objects.get(id=client_id, organization=organization)
            except (Client.DoesNotExist, ValueError):
                pass

        with transaction.atomic():
            project = Project.objects.create(
                name=str(project_name).strip(),
                description=description or None,
                organization=organization,
                client=client_obj,
                created_by=user,
                project_date=project_date or None,
            )

            # Determine task snapshot source
            tasks_snapshot = payload.get('tasks')

            if tasks_snapshot is not None:
                # User provided customized snapshot
                for task_idx, t_data in enumerate(tasks_snapshot):
                    t_name = t_data.get('name')
                    if not t_name or not str(t_name).strip():
                        continue
                    t_desc = t_data.get('description', '')
                    t_priority = t_data.get('priority', 'MEDIUM')
                    if t_priority not in ('LOW', 'MEDIUM', 'HIGH'):
                        t_priority = 'MEDIUM'

                    task_obj = Task.objects.create(
                        project=project,
                        organization=organization,
                        name=str(t_name).strip(),
                        description=t_desc or None,
                        priority=t_priority,
                        status='PENDING',
                        created_by=user,
                    )

                    subtasks_snapshot = t_data.get('subtasks', [])
                    for st_idx, st_data in enumerate(subtasks_snapshot):
                        st_name = st_data.get('name') if isinstance(st_data, dict) else str(st_data)
                        if not st_name or not str(st_name).strip():
                            continue
                        SubTask.objects.create(
                            task=task_obj,
                            name=str(st_name).strip(),
                            status='PENDING',
                        )
            elif template is not None:
                # Default template tasks
                template_tasks = template.tasks.all().order_by('position', 'created_at')
                for t_item in template_tasks:
                    task_obj = Task.objects.create(
                        project=project,
                        organization=organization,
                        name=t_item.name,
                        description=t_item.description,
                        priority=t_item.priority or 'MEDIUM',
                        status='PENDING',
                        created_by=user,
                    )
                    for st_item in t_item.subtasks.all().order_by('position', 'created_at'):
                        SubTask.objects.create(
                            task=task_obj,
                            name=st_item.name,
                            status='PENDING',
                        )

            return project
