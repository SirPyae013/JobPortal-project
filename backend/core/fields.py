from rest_framework import serializers


class SkillNamesField(serializers.ListField):
    child = serializers.CharField(max_length=80)

    def get_attribute(self, instance):
        return instance.skills.all()

    def to_representation(self, data):
        return [skill.name for skill in data]
