FROM node:22-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY angular.json tsconfig*.json ./
COPY src/ src/
COPY public/ public/
RUN npm run build -- --configuration production

FROM nginx:1.28-alpine AS runtime
RUN apk add --no-cache python3 ca-certificates
COPY --from=build /build/dist/solar-ai-front/browser/ /usr/share/nginx/html/
COPY deploy/front.py deploy/nginx.conf.template /opt/solar/
# IAM e o padrao. FRONT_AUTH_MODE=local e um opt-out explicito, apenas para Docker local.
ENV FRONT_AUTH_MODE=iam PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER nginx
EXPOSE 8080
ENTRYPOINT ["python3", "/opt/solar/front.py"]
