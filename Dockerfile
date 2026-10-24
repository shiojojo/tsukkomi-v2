FROM node:22-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate && pnpm install --frozen-lockfile

FROM node:22-alpine AS production-dependencies-env
COPY ./package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate && pnpm install --prod --frozen-lockfile

FROM node:22-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
# These are public client configuration, not secrets; client code embeds them at build time.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLIC_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_PUBLIC_KEY=${VITE_SUPABASE_PUBLIC_KEY}
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate && pnpm run build

FROM node:22-alpine
COPY ./package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
COPY ./scripts/start-server.mjs /app/scripts/start-server.mjs
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
ENV NODE_ENV=production
USER node
CMD ["node", "./scripts/start-server.mjs"]
