# Dev server Expo (Metro Bundler)
# Serve il bundle JS al dispositivo fisico o emulatore sulla LAN
FROM node:20-alpine

# Expo ha bisogno di alcune utility
RUN apk add --no-cache git curl

WORKDIR /app

COPY package*.json ./
RUN npm install && \
    npm cache clean --force

COPY . .

# Porta Metro Bundler
EXPOSE 8081
# Porte Expo DevTools
EXPOSE 19000
EXPOSE 19001
EXPOSE 19002

# REACT_NATIVE_PACKAGER_HOSTNAME verrà iniettato da docker-compose
# tramite la variabile EXPO_DEVTOOLS_LISTEN_ADDRESS
ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0

CMD ["npx", "expo", "start", "--host", "lan", "--port", "8081"]
