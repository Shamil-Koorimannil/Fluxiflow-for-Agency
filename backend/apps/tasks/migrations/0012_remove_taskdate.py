import uuid
from django.db import migrations


def migrate_task_dates_to_independent_tasks(apps, schema_editor):
    try:
        Task = apps.get_model('tasks', 'Task')
        TaskDate = apps.get_model('tasks', 'TaskDate')
    except LookupError:
        return

    # Group TaskDate entries by task to set primary due_date if missing
    for td in TaskDate.objects.all().order_by('date'):
        try:
            task = Task.objects.get(id=td.task_id)
            if not task.due_date:
                task.due_date = td.date
                task.save(update_fields=['due_date'])
        except Task.DoesNotExist:
            continue


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0011_taskdate_taskdate_unique_task_date_and_more'),
    ]

    operations = [
        migrations.RunPython(
            migrate_task_dates_to_independent_tasks,
            reverse_code=migrations.RunPython.noop
        ),
        migrations.DeleteModel(
            name='TaskDate',
        ),
    ]
