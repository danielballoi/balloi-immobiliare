import os
import boto3

def handler(event, context):
    ec2 = boto3.client('ec2')
    sns = boto3.client('sns')

    tag_key = os.environ.get('INSTANCE_TAG_KEY', 'Project')
    tag_value = os.environ['INSTANCE_TAG_VALUE']
    topic_arn = os.environ['SNS_TOPIC_ARN']

    response = ec2.describe_instances(
        Filters=[
            {'Name': f'tag:{tag_key}', 'Values': [tag_value]},
            {'Name': 'instance-state-name', 'Values': ['running']},
        ]
    )

    running = [
        instance['InstanceId']
        for reservation in response['Reservations']
        for instance in reservation['Instances']
    ]

    if running:
        messaggio = (
            f"Promemoria: {len(running)} istanza/e EC2 del progetto Balloi immobiliare "
            f"risultano ACCESE in questo momento: {', '.join(running)}.\n\n"
            "Se non ti servono piu', spegnile con 'terraform destroy' dalla cartella infra/, "
            "oppure dalla AWS Console (anche da telefono)."
        )
        sns.publish(
            TopicArn=topic_arn,
            Subject="Istanza AWS accesa - Balloi immobiliare",
            Message=messaggio,
        )

    return {"running_instances": running}
