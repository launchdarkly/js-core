import StackTrace from '../stack/StackTrace';
import { Breadcrumb } from './Breadcrumb';

export interface ErrorData {
  type: string;
  message: string;
  stack: StackTrace;
  breadcrumbs: Breadcrumb[];
  sessionId: string;
}
