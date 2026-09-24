# ── SNS: topic + iscrizione email ──────────────────────────────────────────
resource "aws_sns_topic" "istanza_accesa" {
  name = "balloi-istanza-accesa"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.istanza_accesa.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ── Lambda: controlla se un'istanza del progetto e' accesa ────────────────
data "archive_file" "check_instance_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda/check_instance.py"
  output_path = "${path.module}/lambda/check_instance.zip"
}

resource "aws_iam_role" "lambda_check_instance" {
  name = "balloi-lambda-check-instance"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_check_instance" {
  name = "balloi-lambda-check-instance-policy"
  role = aws_iam_role.lambda_check_instance.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ec2:DescribeInstances"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = aws_sns_topic.istanza_accesa.arn
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_lambda_function" "check_instance" {
  function_name    = "balloi-check-instance-accesa"
  role             = aws_iam_role.lambda_check_instance.arn
  handler          = "check_instance.handler"
  runtime          = "python3.13"
  filename         = data.archive_file.check_instance_zip.output_path
  source_code_hash = data.archive_file.check_instance_zip.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      SNS_TOPIC_ARN      = aws_sns_topic.istanza_accesa.arn
      INSTANCE_TAG_KEY   = "Project"
      INSTANCE_TAG_VALUE = var.project_tag
    }
  }
}

# ── EventBridge: sveglia la Lambda ogni ora ────────────────────────────────
resource "aws_cloudwatch_event_rule" "ogni_ora" {
  name                = "balloi-controllo-orario-istanza"
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_target" "lambda" {
  rule      = aws_cloudwatch_event_rule.ogni_ora.name
  target_id = "check-instance"
  arn       = aws_lambda_function.check_instance.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.check_instance.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.ogni_ora.arn
}
