FROM node:argon

# Create app directory
RUN mkdir -p /usr/src/app/compressor
WORKDIR /usr/src/app/compressor

COPY . .

# Install app dependencies
RUN npm install --production

# Setup environment
ENV WEPLAY_REDIS_URI "redis:$REDIS_PORT_6379_TCP_PORT"

# Run
CMD [ "node", "index.js" ]