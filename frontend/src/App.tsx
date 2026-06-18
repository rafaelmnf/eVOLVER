/*
 * eVOLVER App — Route configuration
 * Design: "Bioluminescence" — Dark Scientific Editorial
 */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LiveDataProvider } from "./contexts/LiveDataContext";
import Dashboard from "./pages/Dashboard";
import Experiments from "./pages/Experiments";
import Experiment from "./pages/Experiment";
import ConfigureExperiment from "./pages/ConfigureExperiment";
import Devices from "./pages/Devices";
import Alerts from "./pages/Alerts";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  return <Component />;
}

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/cadastro" component={Cadastro} />
      <Route path="/">
        {isAuthenticated ? <Redirect to="/experimentos" /> : <Redirect to="/login" />}
      </Route>

      {/* Protected Routes */}
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/experimentos"><ProtectedRoute component={Experiments} /></Route>
      <Route path="/experimento/:id/configurar"><ProtectedRoute component={ConfigureExperiment} /></Route>
      <Route path="/experimento/:id"><ProtectedRoute component={Experiment} /></Route>
      <Route path="/dispositivos"><ProtectedRoute component={Devices} /></Route>
      <Route path="/alertas"><ProtectedRoute component={Alerts} /></Route>
      <Route path="/configuracoes"><ProtectedRoute component={Settings} /></Route>
      
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <LiveDataProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </LiveDataProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
