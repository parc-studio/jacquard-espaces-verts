import { projectOrderConfig } from './orderable/configs/projectOrderConfig'
import { OrderablePane } from './orderable/OrderablePane'

export function ProjectOrderPane() {
  return <OrderablePane config={projectOrderConfig} />
}
