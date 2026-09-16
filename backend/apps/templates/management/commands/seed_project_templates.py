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


SOFTWARE_TECHNOLOGY_TEMPLATES_DATA = [
    {
        "name": "Software Development",
        "description": "Comprehensive software development workflow covering requirement planning, UI/UX design, core modules, API integrations, testing, and production launch.",
        "icon": "code",
        "tasks": [
            {
                "name": "Requirement & Product Planning",
                "subtasks": [
                    "Requirements & Scope",
                    "Functional Specification",
                    "Technical Specification",
                ],
            },
            {
                "name": "UI/UX Design",
                "subtasks": [
                    "User Interface",
                    "User Experience",
                    "Design System",
                    "Prototype",
                ],
            },
            {
                "name": "User & Authentication Module",
                "subtasks": [
                    "Registration & Login",
                    "User Profiles",
                    "Roles & Permissions",
                    "Authentication & Security",
                ],
            },
            {
                "name": "Core Application Modules",
                "subtasks": [
                    "Module 1 — Based on project requirements",
                    "Module 2 — Based on project requirements",
                    "Module 3 — Based on project requirements",
                    "Module 4 — Based on project requirements",
                ],
            },
            {
                "name": "Admin & Management Module",
                "subtasks": [
                    "Admin Dashboard",
                    "User Management",
                    "System Management",
                    "Reports & Controls",
                ],
            },
            {
                "name": "API & Integration Module",
                "subtasks": [
                    "APIs",
                    "Third-party Integrations",
                    "Notifications",
                    "External Services",
                ],
            },
            {
                "name": "Database & Backend",
                "subtasks": [
                    "Database",
                    "Backend Services",
                    "Business Logic",
                ],
            },
            {
                "name": "Testing & QA",
                "subtasks": [
                    "Functional Testing",
                    "Integration Testing",
                    "Performance & Security Testing",
                    "Bug Resolution",
                ],
            },
            {
                "name": "Deployment & Launch",
                "subtasks": [
                    "Production Setup",
                    "Deployment",
                    "Final Verification",
                ],
            },
        ],
    },
    {
        "name": "Web Application",
        "description": "Full-stack web application development blueprint from requirements and interface design to admin panel, integrations, and deployment.",
        "icon": "globe",
        "tasks": [
            {
                "name": "Requirement Gathering",
                "subtasks": [
                    "Business Requirements",
                    "Functional Requirements",
                    "User Roles & User Flows",
                    "Feature Scope",
                ],
            },
            {
                "name": "UI/UX Design",
                "subtasks": [
                    "Website / Application Interface",
                    "Dashboard Interface",
                    "Responsive Design",
                    "Design System",
                ],
            },
            {
                "name": "Authentication & User Management",
                "subtasks": [
                    "Registration & Login",
                    "User Profile",
                    "Roles & Permissions",
                    "Account Management",
                ],
            },
            {
                "name": "Core Web Application",
                "subtasks": [
                    "Dashboard",
                    "Main Application Module",
                    "User-facing Modules",
                    "Data Management Modules",
                    "Reports / Analytics",
                ],
            },
            {
                "name": "Admin Panel",
                "subtasks": [
                    "Admin Dashboard",
                    "User Management",
                    "Content / Data Management",
                    "Reports & Settings",
                ],
            },
            {
                "name": "Backend & API",
                "subtasks": [
                    "Backend System",
                    "Database",
                    "API",
                    "Business Logic",
                ],
            },
            {
                "name": "Integrations",
                "subtasks": [
                    "Payment Integration",
                    "Communication Integration",
                    "Third-party APIs",
                    "Analytics / Tracking",
                ],
            },
            {
                "name": "Testing & QA",
                "subtasks": [
                    "Application Testing",
                    "Browser & Device Testing",
                    "Security & Performance Testing",
                    "Bug Resolution",
                ],
            },
            {
                "name": "Deployment & Launch",
                "subtasks": [
                    "Hosting & Server",
                    "Domain & SSL",
                    "Production Deployment",
                    "Final Launch",
                ],
            },
        ],
    },
    {
        "name": "Mobile Application",
        "description": "iOS and Android mobile app development workflow covering planning, design, core features, OS-specific builds, and store releases.",
        "icon": "smartphone",
        "tasks": [
            {
                "name": "Requirement & Product Planning",
                "subtasks": [
                    "Product Requirements",
                    "Feature Scope",
                    "User Flows",
                    "Platform Requirements",
                ],
            },
            {
                "name": "UI/UX Design",
                "subtasks": [
                    "Mobile App Interface",
                    "User Experience",
                    "Design System",
                    "Prototype",
                ],
            },
            {
                "name": "Authentication & User Management",
                "subtasks": [
                    "Registration & Login",
                    "User Profile",
                    "Roles & Permissions",
                    "Account Management",
                ],
            },
            {
                "name": "Core Mobile Application",
                "subtasks": [
                    "Home / Dashboard",
                    "Main Application Module",
                    "User Features",
                    "Content / Data Modules",
                    "Notifications",
                    "Settings",
                ],
            },
            {
                "name": "Backend & API",
                "subtasks": [
                    "Backend System",
                    "Database",
                    "API",
                    "Business Logic",
                ],
            },
            {
                "name": "Admin Panel",
                "subtasks": [
                    "Admin Dashboard",
                    "User Management",
                    "Content / Data Management",
                    "Reports & Settings",
                ],
            },
            {
                "name": "Integrations",
                "subtasks": [
                    "Payment",
                    "Push Notifications",
                    "Maps / Location",
                    "Third-party APIs",
                    "Analytics",
                ],
            },
            {
                "name": "iOS Application",
                "subtasks": [
                    "iOS Implementation",
                    "iOS Testing",
                    "App Store Build",
                ],
            },
            {
                "name": "Android Application",
                "subtasks": [
                    "Android Implementation",
                    "Android Testing",
                    "Play Store Build",
                ],
            },
            {
                "name": "Testing & QA",
                "subtasks": [
                    "Functional Testing",
                    "Device & OS Testing",
                    "Performance Testing",
                    "Security Testing",
                    "Bug Resolution",
                ],
            },
            {
                "name": "App Launch & Handover",
                "subtasks": [
                    "Store Submission",
                    "Production Release",
                    "Final Verification",
                    "Documentation & Handover",
                ],
            },
        ],
    },
    {
        "name": "SaaS Product",
        "description": "End-to-end multi-tenant SaaS product creation covering discovery, design, multi-tenancy, subscription billing, cloud infrastructure, and customer onboarding.",
        "icon": "layers",
        "tasks": [
            {
                "name": "Product Discovery & Requirements",
                "subtasks": [
                    "Business Requirements",
                    "Product Scope",
                    "User Personas & Roles",
                    "Feature Requirements",
                ],
            },
            {
                "name": "UI/UX Design",
                "subtasks": [
                    "SaaS Dashboard",
                    "Application Interface",
                    "User Onboarding",
                    "Account & Settings",
                    "Design System",
                ],
            },
            {
                "name": "Authentication & Account Management",
                "subtasks": [
                    "Registration & Login",
                    "User Profiles",
                    "Organisation / Workspace",
                    "Roles & Permissions",
                    "Account Settings",
                ],
            },
            {
                "name": "Core SaaS Modules",
                "subtasks": [
                    "Dashboard",
                    "Core Product Module 1",
                    "Core Product Module 2",
                    "Core Product Module 3",
                    "Core Product Module 4",
                    "Reports / Analytics",
                ],
            },
            {
                "name": "Subscription & Billing",
                "subtasks": [
                    "Pricing Plans",
                    "Subscription Management",
                    "Payment & Billing",
                    "Invoices",
                    "Upgrade / Downgrade / Cancellation",
                ],
            },
            {
                "name": "Admin & Management",
                "subtasks": [
                    "Super Admin",
                    "Customer Management",
                    "User Management",
                    "Subscription Management",
                    "System Settings",
                    "Reports",
                ],
            },
            {
                "name": "Backend & API",
                "subtasks": [
                    "Backend System",
                    "Database",
                    "API",
                    "Business Logic",
                    "Multi-tenant Architecture",
                ],
            },
            {
                "name": "Integrations",
                "subtasks": [
                    "Payment Services",
                    "Communication Services",
                    "Third-party APIs",
                    "Analytics",
                    "Webhooks",
                ],
            },
            {
                "name": "Security & Infrastructure",
                "subtasks": [
                    "Security",
                    "Data Protection",
                    "Cloud Infrastructure",
                    "Backup & Recovery",
                    "Monitoring",
                ],
            },
            {
                "name": "Testing & QA",
                "subtasks": [
                    "Product Testing",
                    "Module Testing",
                    "Integration Testing",
                    "Security & Performance Testing",
                    "Bug Resolution",
                ],
            },
            {
                "name": "Beta & Launch",
                "subtasks": [
                    "Beta Release",
                    "User Feedback",
                    "Production Release",
                    "Customer Onboarding",
                ],
            },
            {
                "name": "Product Maintenance",
                "subtasks": [
                    "Product Updates",
                    "New Modules",
                    "Bug Fixes",
                    "Performance Optimisation",
                    "Security Updates",
                ],
            },
        ],
    },
]


class Command(BaseCommand):
    help = "Seed V1 Advertising and Software & Technology project templates into the database"

    def handle(self, *args, **options):
        industries_data = [
            {
                "name": "Advertising",
                "description": "Advertising agency services and campaign workflows.",
                "templates": ADVERTISING_TEMPLATES_DATA,
            },
            {
                "name": "Software & Technology",
                "description": "Software & technology product workflows and engineering pipelines.",
                "templates": SOFTWARE_TECHNOLOGY_TEMPLATES_DATA,
            },
        ]

        total_tpl_count = 0
        total_task_count = 0
        total_subtask_count = 0

        with transaction.atomic():
            for ind_data in industries_data:
                industry, created = Industry.objects.get_or_create(
                    name=ind_data["name"],
                    defaults={"description": ind_data["description"], "is_active": True}
                )
                if not created and not industry.is_active:
                    industry.is_active = True
                    industry.save()

                for tpl_data in ind_data["templates"]:
                    template, _ = ProjectTemplate.objects.update_or_create(
                        industry=industry,
                        name=tpl_data["name"],
                        defaults={
                            "description": tpl_data.get("description", ""),
                            "icon": tpl_data.get("icon", ""),
                            "is_active": True,
                        }
                    )
                    total_tpl_count += 1

                    # Ensure idempotency without duplicate tasks/subtasks on multiple runs
                    template.tasks.all().delete()

                    for t_idx, task_info in enumerate(tpl_data["tasks"]):
                        t_obj = TemplateTask.objects.create(
                            template=template,
                            name=task_info["name"],
                            position=t_idx,
                            priority="MEDIUM",
                        )
                        total_task_count += 1

                        for st_idx, st_name in enumerate(task_info.get("subtasks", [])):
                            TemplateSubTask.objects.create(
                                template_task=t_obj,
                                name=st_name,
                                position=st_idx,
                            )
                            total_subtask_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {total_tpl_count} templates, {total_task_count} tasks, and {total_subtask_count} subtasks across {len(industries_data)} industries."
            )
        )
