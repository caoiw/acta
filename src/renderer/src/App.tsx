import { AppProvider, useApp } from "@/state/AppContext";
import { LoadingScreen } from "@/components/ui";
import { Dashboard } from "@/screens/Dashboard";
import { Routines } from "@/screens/Routines";
import { Runs } from "@/screens/Runs";
import { CreateRoutine } from "@/screens/CreateRoutine";
import { Editor } from "@/screens/Editor";
import { Preflight } from "@/screens/Preflight";
import { Runner } from "@/screens/Runner";
import { Report } from "@/screens/Report";
import { Settings } from "@/screens/Settings";

function Router(): React.JSX.Element {
  const { loading, view } = useApp();
  if (loading) return <LoadingScreen />;
  switch (view.screen) {
    case "dashboard":
      return <Dashboard />;
    case "routines":
      return <Routines />;
    case "runs":
      return <Runs />;
    case "create":
      return <CreateRoutine />;
    case "editor":
      return <Editor />;
    case "preflight":
      return <Preflight />;
    case "runner":
      return <Runner />;
    case "report":
      return <Report />;
    case "settings":
      return <Settings />;
  }
}

export default function App(): React.JSX.Element {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
