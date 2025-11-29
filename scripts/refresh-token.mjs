import fs from "fs"
import path from "path"
import crypto from "crypto"
import clipboard from "clipboardy"

const envPath = path.join(process.cwd(), ".env.local")

const newToken = crypto.randomBytes(32).toString("hex")

// 读 .env.local
let env = ""
if (fs.existsSync(envPath))
    env = fs.readFileSync(envPath, "utf8")

const lines = env.split("\n").filter(Boolean)
let found = false
const updated = lines.map((line) => {
    if (line.startsWith("INTERNAL_TOKEN=")) {
        found = true
        return `INTERNAL_TOKEN=${newToken}`
    }
    return line
})
if (!found) updated.push(`INTERNAL_TOKEN=${newToken}`)

fs.writeFileSync(envPath, updated.join("\n") + "\n", "utf8")

console.log("[local] INTERNAL_TOKEN updated in .env.local")
clipboard.writeSync(newToken)
console.log("[local] token copied to clipboard:", newToken)
console.log("[local] to update production environment variable, run:")
console.log("$ vercel env add/update INTERNAL_TOKEN production")
console.log("[local] and paste the token when prompted.")
