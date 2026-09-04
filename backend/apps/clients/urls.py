from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, ClientBrandAssetViewSet, ClientBrandAssetFolderViewSet

router = DefaultRouter()
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'client-brand-assets', ClientBrandAssetViewSet, basename='client-brand-asset')
router.register(r'client-brand-asset-folders', ClientBrandAssetFolderViewSet, basename='client-brand-asset-folder')

urlpatterns = [
    path('clients/<uuid:pk>/projects/add-existing/', ClientViewSet.as_view({'post': 'add_existing_projects'}), name='client-projects-add-existing'),
    path('clients/<uuid:pk>/projects/<uuid:project_id>/', ClientViewSet.as_view({'delete': 'remove_project'}), name='client-projects-remove'),
    path('', include(router.urls)),
]

