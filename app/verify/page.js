import VerifyForm from "../VerifyForm";

export const metadata = { title: "Verify your email - Nova" };

export default async function VerifyPage({ searchParams }) {
  const sp = await searchParams;
  const email = typeof sp?.email === "string" ? sp.email : "";
  return <VerifyForm email={email} />;
}
