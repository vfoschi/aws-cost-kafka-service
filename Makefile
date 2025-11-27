.PHONY: help install build run docker-build docker-push k8s-deploy logs

IMAGE_NAME := aws-cost-service
IMAGE_TAG := latest
REGISTRY := your-registry
NAMESPACE := monitoring

# Docker binary location
DOCKER := $(shell which docker 2>/dev/null || echo /usr/local/bin/docker)

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Installa dipendenze
	npm install

run: ## Esegue in locale
	npm start

docker-build: ## Build Docker image
	$(DOCKER) build -t $(IMAGE_NAME):$(IMAGE_TAG) .
	$(DOCKER) tag $(IMAGE_NAME):$(IMAGE_TAG) $(REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

docker-push: ## Push su registry
	$(DOCKER) push $(REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

docker-run: ## Test container in locale
	$(DOCKER) run --rm --env-file .env $(IMAGE_NAME):$(IMAGE_TAG)

k8s-deploy: ## Deploy su Kubernetes
	kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -f k8s/

logs: ## Mostra logs
	kubectl logs -n $(NAMESPACE) -l app=aws-cost-service -f

k8s-delete: ## Rimuove deployment
	kubectl delete -f k8s/
