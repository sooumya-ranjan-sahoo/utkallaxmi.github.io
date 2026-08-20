/* ---------------------------------------------------------
   DROP-IN REPLACEMENT for loadKey()/saveKey() in
   utkal-laxmi-invoice-system-7.html

   Paste this in place of the existing loadKey/saveKey functions
   (right after `let appliedCoupon = null;`). Nothing else in the
   HTML file needs to change — every other function still calls
   loadKey('ul_products') / saveKey('ul_coupons', coupons) etc.
--------------------------------------------------------- */

// Point this at your deployed backend.
const API_BASE_URL = "http://localhost:4000"; // e.g. "https://api.utkallaxmi.com"

// If you set API_KEY in the backend's .env, put the same value here.
const API_KEY = ""; // e.g. "a-long-random-string"

async function loadKey(key){
  try{
    const res = await fetch(`${API_BASE_URL}/api/kv/${encodeURIComponent(key)}`, {
      headers: API_KEY ? { "x-api-key": API_KEY } : {}
    });
    if(res.status === 404) return []; // key not created yet — same as window.storage behaviour
    if(!res.ok) throw new Error(`Load failed (${res.status})`);
    const data = await res.json();
    return data.value ?? [];
  }catch(e){
    console.error("loadKey error:", e);
    showToast("Could not reach the server — showing empty data.");
    return [];
  }
}

async function saveKey(key, val){
  try{
    const res = await fetch(`${API_BASE_URL}/api/kv/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { "x-api-key": API_KEY } : {})
      },
      body: JSON.stringify({ value: val })
    });
    if(!res.ok) throw new Error(`Save failed (${res.status})`);
  }catch(e){
    console.error("saveKey error:", e);
    showToast("Could not save — please retry.");
  }
}
