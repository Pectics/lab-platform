import { Card } from "@/components/ui/card"

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl py-10 space-y-6">
      <h1 className="text-3xl font-bold">Pectics Lab</h1>
      <p className="text-muted-foreground">
        为真实需求而生的个人实验平台
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-lg font-semibold">QR Bridge</h2>
          <p className="text-muted-foreground text-sm">
            扫码 → 数据 → 传输 → 生成
          </p>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold">Clash Blender</h2>
          <p className="text-muted-foreground text-sm">
            合并多个服务商的代理配置。
          </p>
        </Card>
      </div>
    </main>
  )
}
