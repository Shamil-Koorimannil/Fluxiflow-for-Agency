from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, ClientBrandAssetViewSet

router = DefaultRouter()
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'client-brand-assets', ClientBrandAssetViewSet, basename='client-brand-asset')

urlpatterns = [
    path('', include(router.urls)),
]
