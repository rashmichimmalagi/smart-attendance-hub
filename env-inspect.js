console.log("Checking process.env key names...");
const keys = Object.keys(process.env).filter(k => 
  k.includes("SUPABASE") || 
  k.includes("DATABASE") || 
  k.includes("URL") || 
  k.includes("KEY") || 
  k.includes("POSTGRES") || 
  k.includes("PORT") ||
  k.includes("SECRET")
);
console.log("Found keys:", keys);
for (const k of keys) {
  if (!k.includes("SECRET") && !k.includes("KEY")) {
    console.log(`${k}:`, process.env[k]);
  } else {
    console.log(`${k}: [REDACTED/PRESENT]`);
  }
}
