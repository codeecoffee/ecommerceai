FROM node:24-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

#deps
FROM base AS deps

RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

#build
FROM base AS build

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN npx prisma generate

RUN pnpm build

#prod
FROM base AS production

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY --from=build /app/node_modules ./node_modules

RUN pnpm prune --prod

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/src/main"]