export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const allowCors = (response) => {
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type");
      return response;
    };

    if (request.method === "OPTIONS") {
      return allowCors(new Response(null, { status: 204 }));
    }

    if (pathname === "/api/pingers" && request.method === "GET") {
      const result = await env.DB.prepare(`
        SELECT * FROM pingers ORDER BY created_at DESC
      `).all();

      return allowCors(Response.json(result.results || []));
    }

    if (pathname === "/api/pingers" && request.method === "POST") {
      const body = await request.json();
      const { name, url: targetUrl, interval, active } = body;

      if (!name || !targetUrl || !interval) {
        return allowCors(new Response("Missing required fields", { status: 400 }));
      }

      const result = await env.DB.prepare(`
        INSERT INTO pingers (name, url, interval, active)
        VALUES (?, ?, ?, ?)
      `).bind(name, targetUrl, Number(interval), active === false ? 0 : 1).run();

      return allowCors(Response.json({ ok: true, id: result.meta.last_row_id }));
    }

    if (pathname.startsWith("/api/pingers/") && request.method === "GET") {
      const id = pathname.split("/").at(-1);
      const row = await env.DB.prepare(`SELECT * FROM pingers WHERE id = ?`).bind(id).first();

      if (!row) {
        return allowCors(new Response("Not found", { status: 404 }));
      }

      return allowCors(Response.json(row));
    }

    if (pathname.startsWith("/api/pingers/") && request.method === "PUT") {
      const id = pathname.split("/").at(-1);
      const body = await request.json();
      const { name, url: targetUrl, interval, active } = body;

      await env.DB.prepare(`
        UPDATE pingers
        SET name = ?, url = ?, interval = ?, active = ?
        WHERE id = ?
      `).bind(name, targetUrl, Number(interval), active === false ? 0 : 1, id).run();

      return allowCors(Response.json({ ok: true }));
    }

    if (pathname.startsWith("/api/pingers/") && request.method === "DELETE") {
      const id = pathname.split("/").at(-1);
      await env.DB.prepare(`DELETE FROM pingers WHERE id = ?`).bind(id).run();
      return allowCors(Response.json({ ok: true }));
    }

    return allowCors(new Response("Not found", { status: 404 }));
  },

  async scheduled(controller, env, ctx) {
    const rows = await env.DB.prepare(`
      SELECT * FROM pingers WHERE active = 1
    `).all();

    const pingers = rows.results || [];

    for (const item of pingers) {
      try {
        const res = await fetch(item.url, { method: "GET" });

        if (res.ok) {
          console.log(`✅ ${item.name} is up`);
          continue;
        }

        console.log(`❌ ${item.name} returned ${res.status}`);
        await sendAlert(env, item, `Status ${res.status}`);
      } catch (error) {
        console.log(`❌ ${item.name} error: ${error.message}`);
        await sendAlert(env, item, error.message);
      }
    }
  }
};

async function sendAlert(env, item, reason) {
  if (!env.DISCORD_WEBHOOK || env.DISCORD_WEBHOOK.includes("REPLACE")) {
    console.log(`Alert skipped for ${item.name}: missing webhook config`);
    return;
  }

  await fetch(env.DISCORD_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: `🚨 Pinger failed\nName: ${item.name}\nURL: ${item.url}\nReason: ${reason}`
    })
  });
}
