import {
  Children,
  Fragment,
  isValidElement,
  useId,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type TableHTMLAttributes,
} from "react";
import { ChevronRight, X } from "lucide-react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHandle,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../ui/drawer";

export interface ResponsiveColumn<T> {
  key: string;
  header: ReactNode;
  render: (item: T) => ReactNode;
  cardRole?: "primary" | "status" | "detail" | "actions";
  hideOnCard?: boolean;
}

export interface ResponsiveDataViewProps<T> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  items: T[];
  columns: ResponsiveColumn<T>[];
  getRowKey: (item: T) => string;
  empty?: ReactNode;
  tableProps?: TableHTMLAttributes<HTMLTableElement>;
  onRowClick?: (item: T) => void;
}

const textFromNode = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node))
    return textFromNode(node.props.children);
  return "";
};

const activateCardFromKeyboard = (event: KeyboardEvent<HTMLElement>) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.currentTarget.click();
};

function DataCards<T>({
  items,
  columns,
  getRowKey,
  empty,
  onRowClick,
}: ResponsiveDataViewProps<T>) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const listId = useId();
  if (!items.length)
    return (
      <div className="responsive-data-empty">
        {empty ?? "No records found."}
      </div>
    );
  const primary =
    columns.find((column) => column.cardRole === "primary") ??
    columns.find((column) => !column.hideOnCard);
  const status = columns.find((column) => column.cardRole === "status");
  const actions = columns.find((column) => column.cardRole === "actions");
  const details = columns.filter(
    (column) =>
      column !== primary &&
      column !== status &&
      column !== actions,
  );

  return (
    <div className="responsive-data-cards">
      {items.map((item) => {
        const key = getRowKey(item);
        const isOpen = expanded === key;
        const panelId = `${listId}-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        const primaryContent = primary?.render(item);
        const statusContent = status?.render(item);
        const drawerTitle =
          textFromNode(primaryContent).trim() || "Record details";
        if (onRowClick) {
          return (
            <article
              key={key}
              className="responsive-data-card"
              role="button"
              tabIndex={0}
              aria-label={`View details for ${drawerTitle}`}
              onClick={(event) => {
                if (event.target instanceof Element && event.target.closest('button,a')) return;
                onRowClick(item);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                if (event.target instanceof Element && event.target.closest('button,a')) return;
                event.preventDefault();
                onRowClick(item);
              }}
            >
              <div className="responsive-data-card__summary">
                <div className="responsive-data-card__primary">{primaryContent}</div>
                {status && <div className="responsive-data-card__status">{statusContent}</div>}
                <ChevronRight className="responsive-data-card__affordance" size={18} strokeWidth={2} aria-hidden />
              </div>
              {actions && <div className="responsive-data-card__inline-actions">{actions.render(item)}</div>}
            </article>
          );
        }
        return (
          <Drawer
            key={key}
            open={isOpen}
            onOpenChange={(open) => setExpanded(open ? key : null)}
            shouldScaleBackground={false}
          >
            <DrawerTrigger asChild>
              <article
                className="responsive-data-card"
                role="button"
                tabIndex={0}
                aria-label={`View details for ${drawerTitle}`}
                onKeyDown={activateCardFromKeyboard}
              >
                <div className="responsive-data-card__summary">
                  <div className="responsive-data-card__primary">
                    {primaryContent}
                  </div>
                  {status && (
                    <div className="responsive-data-card__status">
                      {statusContent}
                    </div>
                  )}
                  <ChevronRight
                    className="responsive-data-card__affordance"
                    size={18}
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
              </article>
            </DrawerTrigger>
            <DrawerContent
              className="responsive-record-drawer"
              onClick={(event) => event.stopPropagation()}
            >
              <DrawerHandle className="responsive-record-drawer__handle" />
              <DrawerHeader className="responsive-record-drawer__header">
                <div>
                  <DrawerTitle>{drawerTitle}</DrawerTitle>
                  <DrawerDescription>Record details</DrawerDescription>
                </div>
                <DrawerClose
                  className="responsive-record-drawer__close"
                  aria-label="Close record details"
                >
                  <X size={19} aria-hidden />
                </DrawerClose>
              </DrawerHeader>
              <div className="responsive-record-drawer__body" id={panelId}>
                {status && (
                  <div className="responsive-data-card__field">
                    <span>{status.header}</span>
                    <div>{statusContent}</div>
                  </div>
                )}
                {details.map((column) => (
                  <div className="responsive-data-card__field" key={column.key}>
                    <span>{column.header}</span>
                    <div>{column.render(item)}</div>
                  </div>
                ))}
              </div>
              {actions && (
                <DrawerFooter
                  className="responsive-data-card__actions"
                  onClickCapture={(event) => {
                    event.stopPropagation();
                    if ((event.target as Element).closest("button,a"))
                      setExpanded(null);
                  }}
                >
                  {actions.render(item)}
                </DrawerFooter>
              )}
            </DrawerContent>
          </Drawer>
        );
      })}
    </div>
  );
}

export default function ResponsiveDataView<T>(
  props: ResponsiveDataViewProps<T>,
) {
  const {
    items,
    columns,
    getRowKey,
    empty,
    tableProps,
    onRowClick,
    className = "",
    ...containerProps
  } = props;
  const desktop = useMediaQuery("(min-width: 1200px)");
  if (!desktop)
    return (
      <div className={`responsive-data-view ${className}`} data-responsive-data-view {...containerProps}>
        <DataCards {...props} />
      </div>
    );
  return (
    <div className={`responsive-data-view ${className}`} data-responsive-data-view {...containerProps}>
      <div className="responsive-data-view__table">
        <table {...tableProps}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((item) => (
                <tr key={getRowKey(item)} onClick={() => onRowClick?.(item)}>
                  {columns.map((column) => (
                    <td key={column.key}>{column.render(item)}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>{empty ?? "No records found."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ElementWithChildren = ReactElement<{
  children?: ReactNode;
  colSpan?: number;
  onClick?: (event: unknown) => void;
}>;

const childElements = (node: ReactNode): ElementWithChildren[] =>
  Children.toArray(node).flatMap((child): ElementWithChildren[] => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [];
    if (child.type === Fragment) return childElements(child.props.children);
    return [child as ElementWithChildren];
  });

const findChild = (node: ReactNode, type: string) =>
  childElements(node).find((child) => child.type === type);

/** Drop-in bridge for the app's existing semantic tables. New data views should use ResponsiveDataView<T>. */
interface ResponsiveTableProps extends TableHTMLAttributes<HTMLTableElement> {
  mobileRowClick?: boolean;
}

export function ResponsiveTable({
  children,
  className = "",
  mobileRowClick = true,
  ...tableProps
}: ResponsiveTableProps) {
  const desktop = useMediaQuery("(min-width: 1200px)");
  const [expanded, setExpanded] = useState<string | null>(null);
  const listId = useId();
  if (desktop)
    return (
      <table className={className} {...tableProps}>
        {children}
      </table>
    );

  const head = findChild(children, "thead");
  const body = findChild(children, "tbody");
  const headingRow = head && findChild(head.props.children, "tr");
  const headings = headingRow
    ? childElements(headingRow.props.children).map(
        (cell) => cell.props.children,
      )
    : [];
  const rows = body
    ? childElements(body.props.children).filter((child) => child.type === "tr")
    : [];

  return (
    <div
      className={`responsive-data-cards responsive-table-cards ${className ? `${className}-cards` : ""}`}
      data-responsive-table
    >
      {rows.map((row, rowIndex) => {
        const cells = childElements(row.props.children).filter(
          (cell) => cell.type === "td",
        );
        const key = String(row.key ?? rowIndex);
        if (cells.length === 1 && (cells[0]?.props.colSpan ?? 0) > 1)
          return (
            <div className="responsive-data-empty" key={key}>
              {cells[0]?.props.children}
            </div>
          );
        const labeled = cells.map((cell, index) => ({
          cell,
          label: headings[index],
          labelText: textFromNode(headings[index]).trim(),
        }));
        const primaryIndex = Math.max(
          0,
          labeled.findIndex(
            ({ labelText }) =>
              labelText && !/^(select|actions?)$/i.test(labelText),
          ),
        );
        const statusIndex = labeled.findIndex(({ labelText }) =>
          /status|state/i.test(labelText),
        );
        const actionIndexes = labeled
          .map(({ labelText }, index) =>
            !labelText || /actions?/i.test(labelText) ? index : -1,
          )
          .filter((index) => index >= 0 && index !== primaryIndex);
        const isOpen = expanded === key;
        const panelId = `${listId}-${rowIndex}`;
        const drawerTitle =
          textFromNode(labeled[primaryIndex]?.cell.props.children).trim() ||
          "Record details";
        const summary = (
          <div className="responsive-data-card__summary">
            <div className="responsive-data-card__primary">
              {labeled[primaryIndex]?.cell.props.children}
            </div>
            {statusIndex >= 0 && statusIndex !== primaryIndex && (
              <div className="responsive-data-card__status">
                {labeled[statusIndex]?.cell.props.children}
              </div>
            )}
            <ChevronRight
              className="responsive-data-card__affordance"
              size={18}
              strokeWidth={2}
              aria-hidden
            />
          </div>
        );
        if (mobileRowClick && row.props.onClick) {
          return (
            <article
              key={key}
              className="responsive-data-card"
              role="button"
              tabIndex={0}
              aria-label={`View details for ${drawerTitle}`}
              onClick={(event) => {
                if (
                  event.target instanceof Element &&
                  event.target.closest("button,a")
                )
                  return;
                row.props.onClick?.(event);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                if (
                  event.target instanceof Element &&
                  event.target.closest("button,a")
                )
                  return;
                event.preventDefault();
                row.props.onClick?.(event);
              }}
            >
              {summary}
              {actionIndexes.length > 0 && (
                <div
                  className="responsive-data-card__inline-actions"
                  onPointerDown={(event) => {
                    if (
                      event.target instanceof Element &&
                      event.target.closest("button,a")
                    )
                      event.stopPropagation();
                  }}
                  onClick={(event) => {
                    if (
                      event.target instanceof Element &&
                      event.target.closest("button,a")
                    )
                      event.stopPropagation();
                  }}
                >
                  {actionIndexes.map((index) => (
                    <Fragment key={index}>
                      {labeled[index]?.cell.props.children}
                    </Fragment>
                  ))}
                </div>
              )}
            </article>
          );
        }
        return (
          <Drawer
            key={key}
            open={isOpen}
            onOpenChange={(open) => setExpanded(open ? key : null)}
            shouldScaleBackground={false}
          >
            <DrawerTrigger asChild>
              <article
                className="responsive-data-card"
                role="button"
                tabIndex={0}
                aria-label={`View details for ${drawerTitle}`}
                onKeyDown={activateCardFromKeyboard}
              >
                {summary}
              </article>
            </DrawerTrigger>
            <DrawerContent
              className="responsive-record-drawer"
              onClick={(event) => event.stopPropagation()}
            >
              <DrawerHandle className="responsive-record-drawer__handle" />
              <DrawerHeader className="responsive-record-drawer__header">
                <div>
                  <DrawerTitle>{drawerTitle}</DrawerTitle>
                  <DrawerDescription>Record details</DrawerDescription>
                </div>
                <DrawerClose
                  className="responsive-record-drawer__close"
                  aria-label="Close record details"
                >
                  <X size={19} aria-hidden />
                </DrawerClose>
              </DrawerHeader>
              <div className="responsive-record-drawer__body" id={panelId}>
                {statusIndex >= 0 &&
                  statusIndex !== primaryIndex &&
                  labeled[statusIndex]?.labelText && (
                    <div className="responsive-data-card__field">
                      <span>{labeled[statusIndex]?.label}</span>
                      <div>{labeled[statusIndex]?.cell.props.children}</div>
                    </div>
                  )}
                {labeled.map(({ cell, label, labelText }, index) =>
                  index !== primaryIndex &&
                  index !== statusIndex &&
                  !actionIndexes.includes(index) &&
                  labelText ? (
                    <div className="responsive-data-card__field" key={index}>
                      <span>{label}</span>
                      <div>{cell.props.children}</div>
                    </div>
                  ) : null,
                )}
              </div>
              {actionIndexes.length > 0 && (
                <DrawerFooter
                  className="responsive-data-card__actions"
                  onClickCapture={(event) => {
                    event.stopPropagation();
                    if ((event.target as Element).closest("button,a"))
                      setExpanded(null);
                  }}
                >
                  {actionIndexes.map((index) => (
                    <Fragment key={index}>
                      {labeled[index]?.cell.props.children}
                    </Fragment>
                  ))}
                </DrawerFooter>
              )}
            </DrawerContent>
          </Drawer>
        );
      })}
    </div>
  );
}
