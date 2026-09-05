import { useState } from 'react';
import { Button, Modal, Tooltip } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

export function ResetChartObjects({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip title="Сбросить объекты">
        <Button
          type="text"
          icon={<DeleteOutlined />}
          aria-label="Сбросить объекты"
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      <Modal
        title="Удалить объекты текущего графика?"
        open={open}
        okText="Удалить"
        cancelText="Отмена"
        okButtonProps={{ danger: true }}
        onCancel={() => setOpen(false)}
        onOk={() => {
          onConfirm();
          setOpen(false);
        }}
      >
        Будут удалены все рисунки только для текущей пары и таймфрейма.
      </Modal>
    </>
  );
}
