FROM node:22-alpine AS builder

WORKDIR /app

# Copiar package.json files
COPY package.json ./
COPY apps/shared/package.json ./apps/shared/
COPY apps/client/package.json ./apps/client/

# Instalar dependências
RUN npm install

# Copiar código fonte
COPY apps/shared ./apps/shared
COPY apps/client ./apps/client
COPY tsconfig.json ./

# Build do shared primeiro
RUN npm run build -w @boundless/shared

# Build do client
RUN npm run build -w @boundless/client

# Estágio de produção com nginx
FROM nginx:alpine

# Copiar build do client
COPY --from=builder /app/apps/client/dist /usr/share/nginx/html

# Copiar configuração do nginx
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
