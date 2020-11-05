export interface ICommand {
    title: string;
    command: string;
    category: string;
}
  
export interface IExtension {
    activate: () => Promise<void>;
    deactivate: () => void;
}