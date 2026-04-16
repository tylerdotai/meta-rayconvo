.PHONY: help install dev test lint typecheck build run docker-build docker-up docker-down health clean

help:
	@echo "RayConvo — available targets:"
	@grep -E '^[a-zA-Z_-]+:' Makefile | sed 's/:.*//' | xargs -I {} echo "  make {}"

install:
	npm ci

dev:
	npx tsx watch src/backend/server.ts

run:
	node dist/backend/server.js

build:
	tsc --noEmit && echo "TypeScript OK"

typecheck:
	tsc --noEmit

lint:
	eslint src --ext .ts,.tsx,.js,.jsx --max-warnings 0

test:
	vitest run

health:
	@curl -sf http://localhost:3001/health && echo "Backend OK" || echo "Backend DOWN"

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

clean:
	rm -rf dist node_modules/.cache
	rm -f /tmp/rayconvo/audio/*.mp3 /tmp/rayconvo/audio/*.webm
