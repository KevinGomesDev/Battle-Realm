import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { ToastRenderer } from "./components/ToastRenderer";

function App() {
  return (
    <>
      <ToastRenderer />
      <RouterProvider router={router} />
    </>
  );
}

export default App;
