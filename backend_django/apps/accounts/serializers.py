from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, ResetToken
from .utils import generate_token


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        username = data.get('username')
        password = data.get('password')

        user = authenticate(username=username, password=password)
        if user and user.is_active:
            return user
        raise serializers.ValidationError('Username atau Password salah')


class ChangePasswordSerializer(serializers.Serializer):
    username = serializers.CharField()
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate(self, data):
        username = data.get('username')
        old_password = data.get('old_password')
        new_password = data.get('new_password')

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise serializers.ValidationError('Username tidak ditemukan!')

        if not user.check_password(old_password):
            raise serializers.ValidationError('Password lama salah!')

        return data


class RequestResetSerializer(serializers.Serializer):
    username = serializers.CharField()

    def validate(self, data):
        username = data.get('username')
        try:
            User.objects.get(username=username)
        except User.DoesNotExist:
            raise serializers.ValidationError('Username tidak ditemukan!')
        return data


class ResetPasswordSerializer(serializers.Serializer):
    username = serializers.CharField()
    token = serializers.CharField(max_length=10)
    new_password = serializers.CharField(write_only=True)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'role', 'name', 'nisn', 'email', 'kelas', 'program']
        read_only_fields = ['id']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['username', 'password', 'role', 'name', 'nisn', 'email']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = User
        fields = ['username', 'password', 'role', 'name', 'nisn', 'email']

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        if password:
            instance.set_password(password)
        return super().update(instance, validated_data)
