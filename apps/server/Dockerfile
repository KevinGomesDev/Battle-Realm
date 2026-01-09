FROM node:22-alpine

# Instalar OpenSSL para Prisma
RUN apk add --no-cache openssl openssl-dev libc6-compat

WORKDIR /app

# Copiar package.json files
COPY package.json ./
COPY apps/shared/package.json ./apps/shared/
COPY apps/server/package.json ./apps/server/

# Instalar dependências
RUN npm install

# Copiar código fonte
COPY apps/shared ./apps/shared
COPY apps/server ./apps/server
COPY tsconfig.json ./

# Gerar Prisma Client
RUN npm run prisma:generate

# Build do shared primeiro
RUN npm run build -w @boundless/shared

# Build do server
RUN npm run build -w @boundless/server

EXPOSE 3000

# Entrypoint que roda migrações e inicia o servidor
CMD ["sh", "-c", "npx prisma migrate deploy --schema=apps/server/prisma/schema.prisma && npm run start -w @boundless/server"]
