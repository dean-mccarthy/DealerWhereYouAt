## Local development

```sh
npm install
npm run dev
```

## Run with Docker

Build and start the production container with Docker Compose:

```sh
docker compose up -d --build
```

The app will be available at `http://SERVER_IP:8080`. From another machine on
the same network, replace `SERVER_IP` with the server's LAN IP address.

To use the default HTTP port instead:

```sh
BLACKJACK_PORT=80 docker compose up -d --build
```

To deploy over SSH, copy the project to the server and run the same command:

```sh
scp -r . user@SERVER_IP:/opt/blackjack
ssh user@SERVER_IP
cd /opt/blackjack
docker compose up -d --build
```

Check the container and its HTTP health endpoint with:

```sh
docker compose ps
curl http://localhost:8080/healthz
```

If the server has a firewall enabled, allow the selected port, for example:

```sh
sudo ufw allow 8080/tcp
```
