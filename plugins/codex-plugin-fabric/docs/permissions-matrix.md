# Permissions Matrix

This matrix summarizes expected permission needs for Microsoft Fabric Control. Always verify the latest Microsoft Learn pages for your tenant and item type before production use.

| Tool Family | Representative Tools | API Family | Access Type | Expected Role/Scope | Identity Support | Production Risk |
| --- | --- | --- | --- | --- | --- | --- |
| Inventory | `fabric_list_workspaces`, `fabric_get_workspace` | Core Workspaces | Read | Workspace read access | User, service principal where supported | Low |
| Items | `fabric_list_items`, `fabric_get_item`, `fabric_get_item_definition` | Core Items | Read | Viewer or item read permission | User, service principal where supported | Low |
| Definition Export | `fabric_bulk_export_item_definitions` | Core Items beta | Read beta | Workspace/item read, `allowBeta: true` | Depends on item type | Medium |
| Definition Apply | `fabric_update_item_definition` | Core Items | Write/LRO | Item read/write, guarded policy approval | Depends on item type | High |
| Deployment Pipelines | `fabric_deploy_stage_content` | Deployment Pipelines | Write/LRO | Deployment pipeline permissions | User, service principal where supported | High |
| Git Integration | `fabric_git_*` | Git Integration | Read/Write/LRO | Workspace contributor plus Git credentials | User, service principal where supported | Medium/High |
| Connections | `fabric_list_connections`, `fabric_test_connection` | Connections/Gateways | Read/Test | Connection access | User, service principal where supported | Medium |
| Jobs | `fabric_run_item_job` | Item Jobs | Write | Item/job permission | Depends on item type | Medium/High |
| Admin Items | `fabric_admin_*` | Admin Preview | Read admin/preview | Fabric admin or service principal, tenant scopes | Admin/service principal | Medium |
| Capacities | `fabric_list_capacities`, `fabric_get_capacity` | Core Capacities | Read | Capacity visibility | User, service principal where supported | Low |

## Source Families

- Microsoft Fabric Core Items REST API
- Microsoft Fabric Admin Items and Workspaces REST APIs
- Microsoft Fabric Git Integration REST API
- Microsoft Fabric Connections and Gateways REST APIs
- Microsoft Fabric Capacities REST API
- Microsoft Fabric Long Running Operations article

