import ResetForm from "../ResetForm";

export const metadata = { title: "Reset password - Nova" };

export default async function ResetPage({ searchParams }) {
  const sp = await searchParams;
  const email = typeof sp?.email === "string" ? sp.email : "";
  return <ResetForm email={email} />;
}
