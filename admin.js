@'
const http = require("http");

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWRtaW5AbWVyby5sb2NhbCIsInJvbCI6IkFETUlOIiwiaWF0IjoxNzcyNzM4ODU1LCJleHAiOjE3NzI3Njc2NTV9._LW3YyoA4h7BIvPC6Uy1Ofkx7C-eVfw2J9ux7LiJcKc";

function req(path) {
  return new Promise((resolve, reject) => {
    const options = {
      host: "localhost",
      port: 3000,
      path,
      method: "GET",
      headers: { Authorization: "Bearer " + token },
    };

    const r = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    });

    r.on("error", reject);
    r.end();
  });
}

(async () => {
  const a = await req("/api/capturas/asignacion/8");
  console.log("CAPTURAS status", a.status);
  console.log(a.data);

  const m = await req("/api/metricas/hora?fecha=2026-03-05");
  console.log("METRICAS status", m.status);
  console.log(m.data);
})().catch((e) => { console.error(e); process.exit(1); });
'@ | Set-Content -Encoding UTF8 probe.js