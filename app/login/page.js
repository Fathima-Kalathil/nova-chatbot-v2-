import AuthForm from "../AuthForm";

export const metadata = { title: "Log in - Nova" };

export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  const notice = sp?.reset === "1" ? "Your password was updated. Please log in with the new password." : "";
  return <AuthForm mode="login" notice={notice} />;
}
