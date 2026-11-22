import AuthScreen from "./components/AuthScreen";
import ChatWorkspace from "./components/ChatWorkspace";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const { token } = useAuth();

  return token ? <ChatWorkspace /> : <AuthScreen />;
}
