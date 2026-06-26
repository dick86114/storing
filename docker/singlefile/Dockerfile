FROM mcr.microsoft.com/playwright:v1.55.0-noble

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV SINGLEFILE_COMMAND=single-file
ENV SINGLEFILE_BROWSER_EXECUTABLE_PATH=/usr/local/bin/playwright-chromium
ENV SINGLEFILE_TIMEOUT_MS=180000
ENV SINGLEFILE_MAX_BUFFER=83886080

RUN ln -s "$(find /ms-playwright -name chrome -type f | head -n 1)" /usr/local/bin/playwright-chromium && \
    npm install -g single-file-cli@latest && \
    npm cache clean --force

COPY server.mjs ./server.mjs

EXPOSE 3000

CMD ["node", "server.mjs"]
