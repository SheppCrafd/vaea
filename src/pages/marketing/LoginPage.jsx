import LoginScreen from "@/components/auth/LoginScreen";
import { useDocumentMeta } from "./effects";

export default function LoginPage() {
  useDocumentMeta("Sign in | Vaea", "/login");

  return <LoginScreen />;
}
