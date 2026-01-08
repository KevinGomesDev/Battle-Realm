FROM node:22-alpine

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

# Build do server
RUN npm run build -w @boundless/server

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "@boundless/server"]
