import SignUpScreen from "@/components/auth/SignUpScreen";
import { useDocumentMeta } from "./effects";

export default function SignUpPage() {
  useDocumentMeta("Sign up | Vaea", "/signup");

  return <SignUpScreen />;
}
