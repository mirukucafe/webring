
FROM node:18 as build
WORKDIR /build/
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM node:18 as prod
WORKDIR /app/
COPY --from=build /build/package.json /build/yarn.lock ./
COPY --from=build /build/dist ./dist
COPY --from=build /build/views ./views
COPY --from=build /build/static ./static
RUN yarn install --production --frozen-lockfile
CMD ["node", "dist/index"]
