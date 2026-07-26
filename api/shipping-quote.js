// Función serverless de Vercel: cotiza el envío llamando a la API real de Skydropx.
// Probado y confirmado funcionando con las credenciales de la cuenta (OAuth2 client
// credentials -> token -> cotización con pago contra entrega).
//
// Variables de entorno requeridas (en Vercel: Project Settings > Environment Variables;
// en local: site/.env.local, que ya está creado y en .gitignore):
//   SKYDROPX_CLIENT_ID
//   SKYDROPX_CLIENT_SECRET
const TOKEN_URL = "https://pro.skydropx.com/api/v1/oauth/token";
const QUOTES_URL = "https://pro.skydropx.com/api/v1/quotations";

// Origen fijo de tus envíos.
const ORIGIN = { country_code: "CO", postal_code: "111611", area_level1: "Bogotá D.C.", area_level2: "Bogotá" };

// Códigos postales verificados contra la API real de Skydropx. Si una ciudad no está
// aquí (o el código falla), el checkout muestra "Por confirmar por WhatsApp" en vez de
// romperse. Para agregar una ciudad: consigue su código postal exacto (Skydropx lo
// valida contra su propia base, no basta con "cualquier" código de esa ciudad) y
// agrégalo abajo.
const CITY_POSTAL_CODES = {
  "bogota": { postal_code: "111611", area_level1: "Bogotá D.C.", area_level2: "Bogotá" },
  "bogotá": { postal_code: "111611", area_level1: "Bogotá D.C.", area_level2: "Bogotá" },
  "cali": { postal_code: "760001", area_level1: "Valle del Cauca", area_level2: "Cali" },
  "medellin": { postal_code: "050015", area_level1: "Antioquia", area_level2: "Medellín" },
  "medellín": { postal_code: "050015", area_level1: "Antioquia", area_level2: "Medellín" },
  "barranquilla": { postal_code: "081001", area_level1: "Atlántico", area_level2: "Barranquilla" },
  "bucaramanga": { postal_code: "680006", area_level1: "Santander", area_level2: "Bucaramanga" },
  "cartagena": { postal_code: "130014", area_level1: "Bolívar", area_level2: "Cartagena" }
};

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry) return cachedToken;

  const clientId = process.env.SKYDROPX_CLIENT_ID;
  const clientSecret = process.env.SKYDROPX_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret })
  });
  if (!tokenRes.ok) throw new Error("No se pudo autenticar con Skydropx (" + tokenRes.status + ")");

  const tokenData = await tokenRes.json();
  cachedToken = tokenData.access_token;
  cachedTokenExpiry = now + (Number(tokenData.expires_in || 3000) - 60) * 1000;
  return cachedToken;
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function normalizeCity(city) {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body || {};
  const cityInput = body.city;
  const declaredAmount = Math.max(Number(body.declaredAmount) || 0, 1000);
  const weightKg = Number(body.weightKg) || 1;

  if (!cityInput) {
    res.status(400).json({ error: "Falta la ciudad de destino" });
    return;
  }

  if (!process.env.SKYDROPX_CLIENT_ID || !process.env.SKYDROPX_CLIENT_SECRET) {
    res.status(200).json({ configured: false, message: "La cotización automática de envío aún no está activada." });
    return;
  }

  const destination = CITY_POSTAL_CODES[normalizeCity(cityInput)];
  if (!destination) {
    // Ciudad todavía no verificada en nuestra tabla de códigos postales.
    res.status(200).json({ configured: false, message: "Ciudad aún no cubierta por la cotización automática." });
    return;
  }

  try {
    const token = await getAccessToken();

    const quoteRes = await fetch(QUOTES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({
        quotation: {
          address_from: ORIGIN,
          address_to: { country_code: "CO", postal_code: destination.postal_code, area_level1: destination.area_level1, area_level2: destination.area_level2 },
          parcel: { weight: weightKg, height: 10, width: 10, length: 10 },
          declared_amount: declaredAmount,
          cash_on_delivery: true,
          on_delivery_amount: declaredAmount
        }
      })
    });

    let data = await quoteRes.json();
    if (!quoteRes.ok) {
      res.status(200).json({ configured: true, error: data });
      return;
    }

    // Algunas rutas no resuelven al instante: si Skydropx aún no terminó de consultar
    // a las transportadoras, esperamos un poco y volvemos a preguntar (máx. ~6s).
    let attempts = 0;
    while (!data.is_completed && attempts < 4) {
      await sleep(1500);
      const pollRes = await fetch(QUOTES_URL + "/" + data.id, {
        headers: { Authorization: "Bearer " + token }
      });
      data = await pollRes.json();
      attempts++;
    }

    const validRates = (data.rates || [])
      .filter(function (r) { return r.success && r.total; })
      .map(function (r) {
        return {
          carrier: r.provider_display_name,
          service: r.provider_service_name,
          price: Math.round(Number(r.total)),
          eta: r.days
        };
      })
      .sort(function (a, b) { return a.price - b.price; });

    res.status(200).json({ configured: true, rates: validRates });
  } catch (err) {
    res.status(200).json({ configured: true, error: err.message });
  }
};
