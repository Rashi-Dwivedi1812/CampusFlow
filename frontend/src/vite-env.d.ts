import type { ComponentType } from "react";

declare module "*.jsx" {
  const component: ComponentType;
  export default component;
}

declare module "./components/upcomingAssignments.jsx" {
  const component: ComponentType;
  export default component;
}

declare module "./components/upcomingAssignments" {
  const component: ComponentType;
  export default component;
}
