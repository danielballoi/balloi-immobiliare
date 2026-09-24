variable "alert_email" {
  description = "Email che riceve l'avviso quando un'istanza del progetto e' accesa"
  type        = string
}

variable "project_tag" {
  description = "Valore del tag Project usato per riconoscere le risorse di questo progetto"
  type        = string
  default     = "balloi-immobiliare"
}

variable "my_ip" {
  description = "Il tuo IP pubblico in formato CIDR (es. 93.45.12.8/32), per limitare l'accesso SSH solo a te"
  type        = string
}

variable "ssh_public_key" {
  description = "Contenuto della chiave pubblica SSH usata per accedere all'istanza EC2"
  type        = string
}
