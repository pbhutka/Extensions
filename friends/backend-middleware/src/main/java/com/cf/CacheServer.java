package com.cf;

import io.vertx.core.Vertx;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.client.WebClient;
import io.vertx.core.json.JsonObject;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class CacheServer {

    private static final Map<String, JsonObject> cache = new ConcurrentHashMap<>();
    private static final Map<String, Long> expiry = new ConcurrentHashMap<>();
    private static final long TTL_MS = 60_000; // 1 minute cache TTL

    public static void main(String[] args) {

        Vertx vertx = Vertx.vertx();
        WebClient client = WebClient.create(vertx);
        Router router = Router.router(vertx);

        router.get("/cf/:endpoint").handler(ctx -> {
            String endpoint = ctx.pathParam("endpoint");
            String query = ctx.request().query();
            String fullUrl = endpoint + "?" + query;

            // Serve from cache if valid
            if (cache.containsKey(fullUrl) &&
                System.currentTimeMillis() < expiry.get(fullUrl)) {
                ctx.json(cache.get(fullUrl));
                return;
            }

            // Fetch from Codeforces API
            client.getAbs("https://codeforces.com/api/" + fullUrl)
                .send(ar -> {
                    if (ar.succeeded()) {
                        JsonObject body = ar.result().bodyAsJsonObject();
                        cache.put(fullUrl, body);
                        expiry.put(fullUrl, System.currentTimeMillis() + TTL_MS);
                        ctx.json(body);
                    } else {
                        ctx.fail(ar.cause());
                    }
                });
        });

        vertx.createHttpServer()
                .requestHandler(router)
                .listen(8080);

        System.out.println("CF Cache Server running at http://localhost:8080");
    }
}
