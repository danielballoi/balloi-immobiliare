data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

resource "aws_security_group" "app" {
  name        = "balloi-app-sg"
  description = "SSH solo da me, porta web pubblica"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH solo dal mio IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.my_ips
  }

  ingress {
    description = "App web (nginx del frontend, porta pubblicata da docker-compose)"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Tutto in uscita: serve per scaricare Docker e le immagini da GHCR"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Project = var.project_tag
  }
}

resource "aws_key_pair" "deploy" {
  key_name   = "balloi-deploy-key"
  public_key = var.ssh_public_key
}

resource "aws_instance" "app" {
  # Crediti CPU illimitati: l'avvio da zero (Docker, pull immagini, init MySQL)
  # esaurisce i crediti standard della t3.micro. Prima era impostato a mano via CLI.
  credit_specification {
    cpu_credits = "unlimited"
  }

  ami                         = data.aws_ami.al2023.id
  instance_type               = "t3.micro"
  subnet_id                   = data.aws_subnets.default.ids[0]
  vpc_security_group_ids      = [aws_security_group.app.id]
  key_name                    = aws_key_pair.deploy.key_name
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.ec2_app.name
  user_data                   = file("${path.module}/user_data.sh")
  user_data_replace_on_change = false

  root_block_device {
    volume_size           = 30
    volume_type           = "gp3"
    delete_on_termination = true
  }

  tags = {
    Name    = "balloi-app-server"
    Project = var.project_tag
  }
}

output "istanza_ip_pubblico" {
  description = "IP pubblico dell'istanza appena creata"
  value       = aws_instance.app.public_ip
}

output "comando_ssh" {
  description = "Comando pronto per collegarti"
  value       = "ssh -i ~/.ssh/balloi_deploy ec2-user@${aws_instance.app.public_ip}"
}
