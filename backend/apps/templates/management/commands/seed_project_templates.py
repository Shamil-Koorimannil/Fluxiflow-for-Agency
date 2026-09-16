from django.core.management.base import BaseCommand
from django.db import transaction
from apps.templates.models import Industry, ProjectTemplate, TemplateTask, TemplateSubTask


ADVERTISING_TEMPLATES_DATA = [
    {
        "name": "Package Design",
        "description": "Packaging design workflow from brief study and concept development to production artwork and final delivery.",
        "icon": "package",
        "tasks": [
            {"name": "Study Brief & Research", "subtasks": []},
            {"name": "Concept Development", "subtasks": []},
            {"name": "Packaging Design", "subtasks": []},
            {"name": "Production Artwork", "subtasks": []},
            {"name": "Final Delivery", "subtasks": []},
        ],
    },
    {
        "name": "Outdoor Print Design",
        "description": "Billboard, poster, and print media design workflow from requirements to print-ready artwork.",
        "icon": "layout",
        "tasks": [
            {"name": "Study & Requirements", "subtasks": []},
            {"name": "Creative Concept", "subtasks": []},
            {"name": "Design Development", "subtasks": []},
            {"name": "Print-Ready Artwork", "subtasks": []},
            {"name": "Final Delivery", "subtasks": []},
        ],
    },
    {
        "name": "Motion Design",
        "description": "2D/3D motion graphics and animation production pipeline.",
        "icon": "video",
        "tasks": [
            {"name": "Brief & Concept", "subtasks": []},
            {"name": "Design Development(Elements)", "subtasks": []},
            {"name": "Animation & Production", "subtasks": []},
            {"name": "Revisions & Final Render", "subtasks": []},
            {"name": "Final Delivery", "subtasks": []},
        ],
    },
    {
        "name": "Static Website",
        "description": "Design and development workflow for marketing websites and landing pages.",
        "icon": "globe",
        "tasks": [
            {"name": "Requirement Gathering", "subtasks": []},
            {"name": "UI/UX Design", "subtasks": []},
            {"name": "Development", "subtasks": []},
            {"name": "Testing & QA", "subtasks": []},
            {"name": "Launch & Delivery", "subtasks": []},
        ],
    },
    {
        "name": "Ecommerce Website",
        "description": "End-to-end online store design, development, content setup, integrations, and launch.",
        "icon": "shopping-bag",
        "tasks": [
            {"name": "Requirement Gathering", "subtasks": []},
            {"name": "UI/UX Design", "subtasks": []},
            {"name": "Frontend Development", "subtasks": []},
            {"name": "Ecommerce Development", "subtasks": []},
            {"name": "Content & Product Setup", "subtasks": []},
            {"name": "Integrations", "subtasks": []},
            {"name": "Testing & QA", "subtasks": []},
            {"name": "Launch & Handover", "subtasks": []},
        ],
    },
    {
        "name": "AI Ad Film",
        "description": "AI-generated visual development, generative video clips, and post-production.",
        "icon": "sparkles",
        "tasks": [
            {"name": "Concept", "subtasks": []},
            {"name": "AI Visual Development", "subtasks": []},
            {"name": "Video clips with post production", "subtasks": []},
            {"name": "Review & Revisions", "subtasks": []},
            {"name": "Final Delivery", "subtasks": []},
        ],
    },
    {
        "name": "Ad Film Production",
        "description": "Commercial film production workflow covering script, storyboard, shoot, and post-production.",
        "icon": "clapperboard",
        "tasks": [
            {"name": "Concept", "subtasks": []},
            {"name": "Script", "subtasks": []},
            {"name": "Storyboard and planning", "subtasks": []},
            {"name": "Production", "subtasks": []},
            {"name": "Post-Production", "subtasks": []},
            {"name": "Review & Revisions", "subtasks": []},
            {"name": "Final Delivery", "subtasks": []},
        ],
    },
    {
        "name": "Brand Strategy",
        "description": "Comprehensive brand messaging, market research, and strategic positioning.",
        "icon": "compass",
        "tasks": [
            {"name": "Discovery & Research", "subtasks": []},
            {
                "name": "Brand Strategy Development",
                "subtasks": [
                    "Market, Audience & competitor research",
                    "Brand Messaging",
                ],
            },
            {"name": "Strategy Presentation & Approval", "subtasks": []},
            {"name": "Final Strategy Document", "subtasks": []},
        ],
    },
    {
        "name": "Campaign Strategy",
        "description": "Ad campaign concepting, strategic planning, presentation, and final campaign execution plan.",
        "icon": "target",
        "tasks": [
            {"name": "Brief & Research", "subtasks": []},
            {"name": "Campaign Concept", "subtasks": []},
            {"name": "Campaign Strategy", "subtasks": []},
            {"name": "Presentation & Approval", "subtasks": []},
            {"name": "Final Campaign Plan", "subtasks": []},
        ],
    },
    {
        "name": "R&D",
        "description": "Research, exploration, insights synthesis, and recommendation reporting.",
        "icon": "microscope",
        "tasks": [
            {"name": "Research Brief", "subtasks": []},
            {"name": "Research & Exploration", "subtasks": []},
            {"name": "Insights & Recommendations", "subtasks": []},
            {"name": "Final R&D Report", "subtasks": []},
        ],
    },
    {
        "name": "Performance Marketing",
        "description": "Paid advertising research, campaign setup, creative setup, optimization, and reporting.",
        "icon": "trending-up",
        "tasks": [
            {"name": "Research, Analysis and Strategy", "subtasks": []},
            {"name": "Creative Setup", "subtasks": []},
            {"name": "Campaign setup & launch", "subtasks": []},
            {"name": "Monitoring & Optimization", "subtasks": []},
            {"name": "Reporting & Review", "subtasks": []},
        ],
    },
    {
        "name": "SEO",
        "description": "Search engine optimization strategy, on-page SEO, technical audit, authority building, and reporting.",
        "icon": "search",
        "tasks": [
            {"name": "SEO Research & Planning", "subtasks": []},
            {"name": "On-Page SEO", "subtasks": []},
            {"name": "Content & Authority Building", "subtasks": []},
            {"name": "Technical SEO", "subtasks": []},
            {"name": "Monthly SEO Report", "subtasks": []},
        ],
    },
    {
        "name": "Social Media",
        "description": "Social media content planning, poster design, reel production, posting, and performance analysis.",
        "icon": "share-2",
        "tasks": [
            {"name": "Research, Analysis and Strategy", "subtasks": []},
            {"name": "Content Calendar", "subtasks": []},
            {
                "name": "Poster",
                "subtasks": [
                    "Concept",
                    "Design",
                ],
            },
            {
                "name": "Reel",
                "subtasks": [
                    "Content",
                    "Shoot",
                    "Post production",
                ],
            },
            {"name": "Posting", "subtasks": []},
            {"name": "Monthly Report", "subtasks": []},
        ],
    },
]


class Command(BaseCommand):
    help = "Seed V1 Advertising project templates into the database"

    def handle(self, *args, **options):
        with transaction.atomic():
            industry, created = Industry.objects.get_or_create(
                name="Advertising",
                defaults={"description": "Advertising agency services and campaign workflows.", "is_active": True}
            )
            if not created and not industry.is_active:
                industry.is_active = True
                industry.save()

            tpl_count = 0
            task_count = 0
            subtask_count = 0

            for tpl_data in ADVERTISING_TEMPLATES_DATA:
                template, _ = ProjectTemplate.objects.update_or_create(
                    industry=industry,
                    name=tpl_data["name"],
                    defaults={
                        "description": tpl_data.get("description", ""),
                        "icon": tpl_data.get("icon", ""),
                        "is_active": True,
                    }
                )
                tpl_count += 1

                # To ensure idempotency without creating duplicate tasks/subtasks on multiple runs,
                # delete existing tasks for this template and recreate them according to order
                template.tasks.all().delete()

                for t_idx, task_info in enumerate(tpl_data["tasks"]):
                    t_obj = TemplateTask.objects.create(
                        template=template,
                        name=task_info["name"],
                        position=t_idx,
                        priority="MEDIUM",
                    )
                    task_count += 1

                    for st_idx, st_name in enumerate(task_info.get("subtasks", [])):
                        TemplateSubTask.objects.create(
                            template_task=t_obj,
                            name=st_name,
                            position=st_idx,
                        )
                        subtask_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {tpl_count} templates, {task_count} tasks, and {subtask_count} subtasks for Advertising industry."
            )
        )
