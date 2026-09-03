export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    service: "dashboard",
    version: "0.1.0",
  });
}
