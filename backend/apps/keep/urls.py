from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.keep.views import KeepItemViewSet, keep_search, access_share_link

router = DefaultRouter()
router.register(r'items', KeepItemViewSet, basename='keep-items')

urlpatterns = [
    path('search/', keep_search, name='keep-search'),
    path('share/<str:token>/', access_share_link, name='keep-share-link'),
    path('', include(router.urls)),
]
