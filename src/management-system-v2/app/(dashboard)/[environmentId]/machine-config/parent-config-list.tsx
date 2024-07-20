'use client';

import styles from '@/components/item-list-view.module.scss';

import {
  Button,
  Grid,
  Dropdown,
  TableColumnsType,
  Tooltip,
  Row,
  TableColumnType,
  Upload,
} from 'antd';
import { FileOutlined } from '@ant-design/icons';
import { AiOutlinePlus } from 'react-icons/ai';
import { useAbilityStore } from '@/lib/abilityStore';
import Bar from '@/components/bar';
import SelectionActions from '@/components/selection-actions';
import { useCallback, useState } from 'react';
import { ParentConfig, ParentConfigMetadata } from '@/lib/data/machine-config-schema';
import useFuzySearch, { ReplaceKeysWithHighlighted } from '@/lib/useFuzySearch';
import ElementList from '@/components/item-list-view';
import { useRouter } from 'next/navigation';
import { AuthCan, useEnvironment } from '@/components/auth-can';
import MachineConfigCreationButton from '@/components/machine-config-creation-button';
import { App } from 'antd';
import SpaceLink from '@/components/space-link';
import {
  CopyOutlined,
  ExportOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOutlined as FolderFilled,
  FileOutlined as FileFilled,
} from '@ant-design/icons';
import {
  deleteParentConfigurations,
  createParentConfig,
  saveParentConfig,
  getConfigurationById,
  copyParentConfig,
} from '@/lib/data/legacy/machine-config';

import AddUserControls from '@/components/add-user-controls';
import { useAddControlCallback } from '@/lib/controls-store';
import ConfirmationButton from '@/components/confirmation-button';
import { useUserPreferences } from '@/lib/user-preferences';
import { generateDateString } from '@/lib/utils';
import MachineConfigModal from '@/components/machine-config-modal';
import { v4 } from 'uuid';
import { defaultParameter } from './configuration-helper';
import { count } from 'console';

type InputItem = ParentConfig;
export type ParentConfigListConfigs = ReplaceKeysWithHighlighted<InputItem, 'name'>;

function folderAwareSort(
  sortFunction: (a: ParentConfigListConfigs, b: ParentConfigListConfigs) => number,
) {
  const sorter: TableColumnType<ParentConfigListConfigs>['sorter'] = (a, b, sortOrder) => {
    const factor = sortOrder === 'ascend' ? 1 : -1;
    return sortFunction(a, b);
  };
  return sorter;
}

const ParentConfigList = ({
  data,
  params,
}: {
  data: InputItem[];
  params: {
    environmentId: string;
  };
}) => {
  const originalConfigs = data;
  const router = useRouter();
  const space = useEnvironment();
  const breakpoint = Grid.useBreakpoint();
  data = data.filter(function (element) {
    return element !== undefined;
  });
  const { filteredData, setSearchQuery: setSearchTerm } = useFuzySearch({
    data: data,
    keys: ['name'],
    highlightedKeys: ['name'],
    transformData: (matches) => matches.map((match) => match.item),
  });

  const { message } = App.useApp();

  const [selectedRowElements, setSelectedRowElements] = useState<ParentConfigListConfigs[]>([]);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const selectedRowKeys = selectedRowElements.map((element) => element.id);
  const [copySelection, setCopySelection] = useState<ParentConfigListConfigs[]>([]);
  const [openCopyModal, setOpenCopyModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ParentConfigListConfigs | null>(null);
  const [openExportModal, setOpenExportModal] = useState(false);
  const [count, setCount] = useState<number>(0); // Ensure count is a number

  const ability = useAbilityStore((state) => state.ability);
  const defaultDropdownItems = [];

  async function deleteItems(items: ParentConfigListConfigs[]) {
    const promises = [];
    const parentConfigIds = items.map((item) => item.id);
    const parentConfigPromise = deleteParentConfigurations(parentConfigIds, space.spaceId);
    if (parentConfigPromise) promises.push(parentConfigPromise);

    await Promise.allSettled(promises);

    const parentConfigsResult = await parentConfigPromise;

    if (parentConfigsResult && 'error' in parentConfigsResult) {
      return message.open({
        type: 'error',
        content: 'Something went wrong',
      });
    }

    setSelectedRowElements([]);
    router.refresh();
  }

  if (ability && ability.can('create', 'MachineConfig'))
    defaultDropdownItems.push({
      key: 'create-machine-config',
      label: <MachineConfigCreationButton wrapperElement="Create Machine Configuration" />,
      icon: <FileOutlined />,
    });

  useAddControlCallback(
    'machineconfig-list',
    'selectall',
    (e) => {
      e.preventDefault();
      setSelectedRowElements(filteredData ?? []);
    },
    { dependencies: [originalConfigs] },
  );
  useAddControlCallback('machineconfig-list', 'esc', () => setSelectedRowElements([]));
  useAddControlCallback('machineconfig-list', 'del', () => setOpenDeleteModal(true));

  function deleteHandle() {
    deleteItems(selectedRowElements).then((res) => {});
  }

  const exportItems = (items: ParentConfigListConfigs[]) => {
    const dataToExport = items.map((item) => ({
      id: item.id,
      name: item.name.value,
      type: item.type,
      lastEdited: item.lastEdited,
      createdOn: item.createdOn,
    }));

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'exported_items.json';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const actionBarGenerator = useCallback(
    (record: any) => {
      const resource = record.type === 'folder' ? { Folder: record } : { Process: record };

      return (
        <>
          {record.type !== 'folder' && (
            <AuthCan {...resource} create>
              <Tooltip placement="top" title={'Copy'}>
                <CopyOutlined
                  onClick={(e) => {
                    // e.stopPropagation();
                    copyItem([record]);
                  }}
                />
              </Tooltip>
            </AuthCan>
          )}

          {record.type !== 'folder' && (
            <Tooltip placement="top" title={'Export'}>
              <ExportOutlined onClick={() => exportItems([record])} />
            </Tooltip>
          )}

          <AuthCan {...resource} update>
            <Tooltip placement="top" title={'Edit'}>
              <EditOutlined onClick={() => editItem(record)} />
            </Tooltip>
          </AuthCan>

          <AuthCan delete {...resource}>
            <Tooltip placement="top" title={'Delete'}>
              <ConfirmationButton
                title={`Delete ${record.type === 'folder' ? 'Folder' : 'Process'}`}
                description="Are you sure you want to delete the selected process?"
                onConfirm={() => deleteItems([record])}
                buttonProps={{
                  icon: <DeleteOutlined />,
                  type: 'text',
                }}
              />
            </Tooltip>
          </AuthCan>
        </>
      );
    },
    [copyItem, deleteItems, editItem, exportItems],
  );

  function copyItem(items: ParentConfigListConfigs[]) {
    setCopySelection(items);
    setSelectedRowElements([items[0]]);
    setOpenCopyModal(true);
  }

  function editItem(item: ParentConfigListConfigs) {
    setEditingItem(item);
    setSelectedRowElements([item]);
    setOpenEditModal(true);
  }

  function handleEdit(values: { id: string; name: string; description: string }[]): Promise<void> {
    const valuesFromModal = values[0];
    if (editingItem) {
      saveParentConfig(valuesFromModal.id, {
        ...editingItem,
        metadata: {
          ...editingItem.metadata,
          description: defaultParameter('description', valuesFromModal.description),
        },
        name: valuesFromModal.name,
      }).then(() => {});
      setOpenEditModal(false);
      router.refresh();
    }
    return Promise.resolve();
  }

  // function handleCopy(
  //   values: { name: string; description: string; originalId: string }[],
  // ): Promise<void> {
  //   const valuesFromModal = values[0];
  //   if (copySelection[0]) {
  //     copyParentConfig(
  //       valuesFromModal.originalId,
  //       {
  //         name: valuesFromModal.name,
  //         metadata: {
  //           description: defaultParameter('description', valuesFromModal.description),
  //         },
  //       },
  //       space.spaceId,
  //     ).then(() => {});
  //     setOpenCopyModal(false);
  //     router.refresh();
  //   }
  //   return Promise.resolve();
  // }

  const importItems = async (file: File) => {
    try {
      const text = await file.text();
      const importedData: ParentConfig[] = JSON.parse(text);

      for (const item of importedData) {
        const config: AbstractConfigInput = {
          id: v4(),
          name: item.name,
          metadata: item.metadata,
          machineConfigs: item.machineConfigs || [],
          targetConfig: item.targetConfig || null,
          type: item.type,
          createdOn: item.createdOn,
          lastEdited: item.lastEdited,
          versions: item.versions,
        };
        await createParentConfig(config, space.spaceId);
      }
      message.success('Import successful');
      router.refresh();
    } catch (error) {
      message.error('Import failed');
      console.error('Error importing items:', error);
    }
  };

  //copy multiple items
  function handleCopy(
    values: { name: string; description: string; originalId: string }[],
  ): Promise<void> {
    const promises = values.map((valueFromModal) => {
      return copyParentConfig(
        valueFromModal.originalId,
        {
          name: valueFromModal.name,
          metadata: {
            description: defaultParameter('description', valueFromModal.description),
          },
        },
        space.spaceId,
      );
    });

    Promise.all(promises).then(() => {
      setOpenCopyModal(false);
      router.refresh();
    });

    return Promise.resolve();
  }

  const addPreferences = useUserPreferences.use.addPreferences();
  const selectedColumns = useUserPreferences.use['columns-in-table-view-process-list']();
  const columns: TableColumnsType<ParentConfigListConfigs> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <SpaceLink
          href={`/machine-config/${record.id}`}
          style={{
            color: 'inherit' /* or any color you want */,
            textDecoration: 'none' /* removes underline */,
            display: 'block',
          }}
        >
          <div
            className={
              breakpoint.xs
                ? styles.MobileTitleTruncation
                : breakpoint.xl
                  ? styles.TitleTruncation
                  : styles.TabletTitleTruncation
            }
            style={{
              // overflow: 'hidden',
              // whiteSpace: 'nowrap',
              // textOverflow: 'ellipsis',
              // TODO: color
              color: undefined,
              fontStyle: undefined,
            }}
          >
            {<FileFilled />} {record.name.highlighted}
          </div>
        </SpaceLink>
      ),
      sorter: (a, b) => (a.name.value || '').localeCompare(b.name.value || ''),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      sorter: (a, b) => (a.name.value || '').localeCompare(b.name.value || ''),
      render: (_, record) => (
        <SpaceLink
          href={`/machine-config/${record.id}`}
          style={{
            color: 'inherit' /* or any color you want */,
            textDecoration: 'none' /* removes underline */,
            display: 'block',
          }}
        >
          {/* {(record.metadata.description?.content[0].value ?? '').length == 0 ? (
            <>&emsp;</>
          ) : (
            record.metadata.description?.content[0].value
          )} */}
          {record.metadata ? record.metadata.description?.content[0].value ?? '' : ''}
          {/* Makes the link-cell clickable, when there is no description */}
          {/* </div> */}
        </SpaceLink>
      ),
      responsive: ['sm'],
    },
    {
      title: 'Last Edited',
      dataIndex: 'lastEdited',
      key: 'Last Edited',
      render: (date: Date) => generateDateString(date, true),
      sorter: (a, b) => (a.name.value || '').localeCompare(b.name.value || ''),
      responsive: ['md'],
    },
    {
      title: 'Config Type',
      dataIndex: 'ConfigType',
      key: 'Config Type',
      sorter: (a, b) => (a.name.value || '').localeCompare(b.name.value || ''),
      render: (_, record) => <>{record.type}</>,
      responsive: ['sm'],
    },
    {
      title: 'Machine ',
      dataIndex: 'Machine',
      key: 'Machine',
      render: (_, record) => <>{record.type}</>,
      sorter: folderAwareSort(
        (a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime(),
      ),
      responsive: ['sm'],
    },
  ];

  return (
    <>
      <Bar
        leftNode={
          <span style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', justifyContent: 'flex-start' }}>
              {!breakpoint.xs && (
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: defaultDropdownItems,
                  }}
                >
                  <Button type="primary" icon={<AiOutlinePlus />}>
                    New
                  </Button>
                </Dropdown>
              )}
              <Upload
                accept=".json"
                showUploadList={false}
                beforeUpload={(file: File) => {
                  importItems(file);
                  return false; // Prevent automatic upload
                }}
              >
                <Tooltip placement="top" title={'Import'}>
                  <Button type="primary" style={{ margin: '0 10px' }}>
                    Import
                  </Button>
                </Tooltip>
              </Upload>

              <SelectionActions count={selectedRowKeys.length}>
                <Tooltip placement="top" title={'Export'}>
                  <ExportOutlined
                    /* className={styles.Icon} */
                    style={{ margin: '0 8px' }}
                    onClick={() => exportItems(selectedRowElements)}
                  />
                </Tooltip>

                {/* <Tooltip placement="top" title={'Copy'}>
                  <CopyOutlined
                    // className={styles.Icon}
                    style={{ margin: '0 8px' }}
                    onClick={() => copyItem(selectedRowElements)}
                  />
                </Tooltip> */}

                <Tooltip placement="top" title={'Edit'}>
                  <EditOutlined
                    style={{ margin: '0 8px' }}
                    // className={styles.Icon}
                    onClick={() => editItem(selectedRowElements[0])}
                    disabled={count !== 1}
                  />
                </Tooltip>
                <Tooltip placement="top" title={'Delete'}>
                  <ConfirmationButton
                    title="Delete Configuration"
                    externalOpen={openDeleteModal}
                    onExternalClose={() => setOpenDeleteModal(false)}
                    description="Are you sure you want to delete the selected configuration(s)?"
                    onConfirm={() => deleteItems(selectedRowElements)}
                    buttonProps={{
                      icon: <DeleteOutlined />,
                      type: 'text',
                    }}
                  />
                </Tooltip>
              </SelectionActions>
            </span>

            {/*<span>
                <Space.Compact className={breakpoint.xs ? styles.MobileToggleView : undefined}>
                  <Button
                    style={!iconView ? { color: '#3e93de', borderColor: '#3e93de' } : {}}
                    onClick={() => addPreferences({ 'icon-view-in-process-list': false })}
                  >
                    <UnorderedListOutlined />
                  </Button>
                  <Button
                    style={!iconView ? {} : { color: '#3e93de', borderColor: '#3e93de' }}
                    onClick={() => addPreferences({ 'icon-view-in-process-list': true })}
                  >
                    <AppstoreOutlined />
                  </Button>
                </Space.Compact>
              </span>*/}
          </span>
        }
        searchProps={{
          onChange: (e) => setSearchTerm(e.target.value),
          onPressEnter: (e) => setSearchTerm(e.currentTarget.value),
          placeholder: 'Search Configurations ...',
        }}
      />
      <ElementList
        data={filteredData as unknown as ParentConfigListConfigs[]}
        columns={columns}
        elementSelection={{
          selectedElements: selectedRowElements,
          setSelectionElements: setSelectedRowElements,
        }}
        selectableColumns={{
          setColumnTitles: (cols) => {
            if (typeof cols === 'function')
              cols = cols(selectedColumns.map((col: any) => col.name) as string[]);

            addPreferences({ 'process-list-columns-desktop': cols });
          },
          selectedColumnTitles: selectedColumns.map((col: any) => col.name) as string[],
          allColumnTitles: ['Name', 'Description', 'LastEdited', 'Type', 'Machine'],
          columnProps: {
            width: 'fit-content',
            responsive: ['xl'],
            render: (id, record) => (
              <Row justify="space-evenly" className={styles.HoverableTableCell}>
                {actionBarGenerator(record)}
              </Row>
            ),
          },
        }}
      />
      <AddUserControls name={'machineconfig-list'} />
      <MachineConfigModal
        open={openEditModal}
        title={`Edit Process${selectedRowKeys.length > 1 ? 'es' : ''}`}
        onCancel={() => setOpenEditModal(false)}
        initialData={
          editingItem
            ? [
                {
                  id: editingItem.id,
                  name: editingItem.name.value ?? '',
                  description: editingItem.metadata.description?.content[0].value ?? '',
                },
              ]
            : []
        }
        onSubmit={handleEdit}
      />
      {/* <MachineConfigModal
        open={openCopyModal}
        title={`Copy Machine Config${selectedRowKeys.length > 1 ? 'es' : ''}`}
        onCancel={() => setOpenCopyModal(false)}
        initialData={copySelection.map((config) => ({
          name: `${config.name.value} (Copy)`,
          description: config.metadata.description?.content[0].value ?? '',
          originalId: config.id,
        }))}
        onSubmit={handleCopy}
      /> */}
      <MachineConfigModal
        open={openCopyModal}
        title={`Copy Machine Config${selectedRowKeys.length > 1 ? 's' : ''}`}
        onCancel={() => setOpenCopyModal(false)}
        initialData={[
          {
            name: `${copySelection[0]?.name.value} (Copy)`,
            description: copySelection[0]?.metadata.description?.content[0].value ?? '',
            originalId: copySelection[0]?.id,
          },
        ]}
        onSubmit={handleCopy}
      />
    </>
  );
};

export default ParentConfigList;
