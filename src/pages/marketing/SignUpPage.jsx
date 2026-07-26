import { useEffect } from "react";
import SignUpScreen from "@/components/auth/SignUpScreen";

export default function SignUpPage() {
  useEffect(() => {
    document.title = "Sign up | Vaea";
  }, []);

  return <SignUpScreen />;
}
